import { Injectable, OnDestroy } from '@angular/core';
import {
  ActivatedRoute, NavigationExtras, Params, PRIMARY_OUTLET, Router,
  UrlSegmentGroup
} from '@angular/router';
import { Observable } from 'rxjs/Observable';
import { filter, flatMap, map, tap } from 'rxjs/operators';
import { ViewMode } from '../../+search-page/search-options.model';
import { RemoteDataBuildService } from '../../core/cache/builders/remote-data-build.service';
import { SortDirection, SortOptions } from '../../core/cache/models/sort-options.model';
import {
  FacetConfigSuccessResponse,
  FacetValueSuccessResponse,
  SearchSuccessResponse
} from '../../core/cache/response-cache.models';
import { ResponseCacheEntry } from '../../core/cache/response-cache.reducer';
import { ResponseCacheService } from '../../core/cache/response-cache.service';
import { PaginatedList } from '../../core/data/paginated-list';
import { ResponseParsingService } from '../../core/data/parsing.service';
import { RemoteData } from '../../core/data/remote-data';
import { GetRequest, RestRequest } from '../../core/data/request.models';
import { RequestService } from '../../core/data/request.service';
import { DSpaceObject } from '../../core/shared/dspace-object.model';
import { GenericConstructor } from '../../core/shared/generic-constructor';
import { HALEndpointService } from '../../core/shared/hal-endpoint.service';
import { configureRequest } from '../../core/shared/operators';
import { URLCombiner } from '../../core/url-combiner/url-combiner';
import { hasNoValue, hasValue, isEmpty, isNotEmpty } from '../../shared/empty.util';
import { PaginationComponentOptions } from '../../shared/pagination/pagination-component-options.model';
import { NormalizedSearchResult } from '../normalized-search-result.model';
import { SearchOptions } from '../search-options.model';
import { SearchResult } from '../search-result.model';
import { FacetValue } from './facet-value.model';
import { SearchFilterConfig } from './search-filter-config.model';
import { SearchResponseParsingService } from '../../core/data/search-response-parsing.service';
import { SearchQueryResponse } from './search-query-response.model';
import { PageInfo } from '../../core/shared/page-info.model';
import { getSearchResultFor } from './search-result-element-decorator';
import { ListableObject } from '../../shared/object-collection/shared/listable-object.model';
import { FacetValueResponseParsingService } from '../../core/data/facet-value-response-parsing.service';
import { FacetConfigResponseParsingService } from '../../core/data/facet-config-response-parsing.service';
import { PaginatedSearchOptions } from '../paginated-search-options.model';
import { FilterLabel } from './filter-label.model';
import { combineLatest } from 'rxjs/observable/combineLatest';
import { Community } from '../../core/shared/community.model';
import { CommunityDataService } from '../../core/data/community-data.service';
import { CollectionDataService } from '../../core/data/collection-data.service';
import { Collection } from '../../core/shared/collection.model';

@Injectable()
export class SearchService implements OnDestroy {
  private searchLinkPath = 'discover/search/objects';
  private facetValueLinkPathPrefix = 'discover/facets/';
  private facetConfigLinkPath = 'discover/facets';

  private sub;

  searchOptions: SearchOptions;

  constructor(private router: Router,
              private route: ActivatedRoute,
              protected responseCache: ResponseCacheService,
              protected requestService: RequestService,
              private rdb: RemoteDataBuildService,
              private halService: HALEndpointService,
              private communityService: CommunityDataService,
              private collectionService: CollectionDataService) {
    const pagination: PaginationComponentOptions = new PaginationComponentOptions();
    pagination.id = 'search-results-pagination';
    pagination.currentPage = 1;
    pagination.pageSize = 10;
    const sort: SortOptions = new SortOptions('score', SortDirection.DESC);
    this.searchOptions = Object.assign(new SearchOptions(), { pagination: pagination, sort: sort });
  }

  search(searchOptions?: PaginatedSearchOptions): Observable<RemoteData<PaginatedList<SearchResult<DSpaceObject>>>> {
    const requestObs = this.halService.getEndpoint(this.searchLinkPath).pipe(
      map((url: string) => {
        if (hasValue(searchOptions)) {
          url = (searchOptions as PaginatedSearchOptions).toRestUrl(url);
        }
        const request = new GetRequest(this.requestService.generateRequestId(), url);
        return Object.assign(request, {
          getResponseParser(): GenericConstructor<ResponseParsingService> {
            return SearchResponseParsingService;
          }
        });
      }),
      configureRequest(this.requestService)
    );
    const requestEntryObs = requestObs.pipe(
      flatMap((request: RestRequest) => this.requestService.getByHref(request.href))
    );

    const responseCacheObs = requestObs.pipe(
      flatMap((request: RestRequest) => this.responseCache.get(request.href))
    );

    // get search results from response cache
    const sqrObs: Observable<SearchQueryResponse> = responseCacheObs.pipe(
      map((entry: ResponseCacheEntry) => entry.response),
      map((response: SearchSuccessResponse) => response.results)
    );

    // turn dspace href from search results to effective list of DSpaceObjects
    // Turn list of observable remote data DSO's into observable remote data object with list of DSO
    const dsoObs: Observable<RemoteData<DSpaceObject[]>> = sqrObs.pipe(
      map((sqr: SearchQueryResponse) => {
        return sqr.objects.map((nsr: NormalizedSearchResult) =>
          this.rdb.buildSingle(nsr.dspaceObject));
      }),
      flatMap((input: Array<Observable<RemoteData<DSpaceObject>>>) => this.rdb.aggregate(input))
    );

    // Create search results again with the correct dso objects linked to each result
    const tDomainListObs = Observable.combineLatest(sqrObs, dsoObs, (sqr: SearchQueryResponse, dsos: RemoteData<DSpaceObject[]>) => {

      return sqr.objects.map((object: NormalizedSearchResult, index: number) => {
        let co = DSpaceObject;
        if (dsos.payload[index]) {
          const constructor: GenericConstructor<ListableObject> = dsos.payload[index].constructor as GenericConstructor<ListableObject>;
          co = getSearchResultFor(constructor);
          return Object.assign(new co(), object, {
            dspaceObject: dsos.payload[index]
          });
        } else {
          return undefined;
        }
      });
    });

    const pageInfoObs: Observable<PageInfo> = responseCacheObs.pipe(
      map((entry: ResponseCacheEntry) => entry.response),
      map((response: FacetValueSuccessResponse) => response.pageInfo)
    );

    const payloadObs = Observable.combineLatest(tDomainListObs, pageInfoObs, (tDomainList, pageInfo) => {
      return new PaginatedList(pageInfo, tDomainList);
    });

    return this.rdb.toRemoteDataObservable(requestEntryObs, responseCacheObs, payloadObs);
  }

  getConfig(scope?: string): Observable<RemoteData<SearchFilterConfig[]>> {
    const requestObs = this.halService.getEndpoint(this.facetConfigLinkPath).pipe(
      map((url: string) => {
        const args: string[] = [];

        if (isNotEmpty(scope)) {
          args.push(`scope=${scope}`);
        }

        if (isNotEmpty(args)) {
          url = new URLCombiner(url, `?${args.join('&')}`).toString();
        }

        const request = new GetRequest(this.requestService.generateRequestId(), url);
        return Object.assign(request, {
          getResponseParser(): GenericConstructor<ResponseParsingService> {
            return FacetConfigResponseParsingService;
          }
        });
      }),
      configureRequest(this.requestService)
    );

    const requestEntryObs = requestObs.pipe(
      flatMap((request: RestRequest) => this.requestService.getByHref(request.href))
    );

    const responseCacheObs = requestObs.pipe(
      flatMap((request: RestRequest) => this.responseCache.get(request.href))
    );

    // get search results from response cache
    const facetConfigObs: Observable<SearchFilterConfig[]> = responseCacheObs.pipe(
      map((entry: ResponseCacheEntry) => entry.response),
      map((response: FacetConfigSuccessResponse) =>
        response.results.map((result: any) => Object.assign(new SearchFilterConfig(), result)))
    );

    return this.rdb.toRemoteDataObservable(requestEntryObs, responseCacheObs, facetConfigObs);
  }

  getFacetValuesFor(filterConfig: SearchFilterConfig, valuePage: number, searchOptions?: SearchOptions, filterQuery?: string): Observable<RemoteData<PaginatedList<FacetValue>>> {
    const requestObs = this.halService.getEndpoint(this.facetValueLinkPathPrefix + filterConfig.name).pipe(
      map((url: string) => {
        const args: string[] = [`page=${valuePage - 1}`, `size=${filterConfig.pageSize}`];
        if (hasValue(filterQuery)) {
          // args.push(`${filterConfig.paramName}=${filterQuery},query`);
          args.push(`prefix=${filterQuery}`);
        }
        if (hasValue(searchOptions)) {
          url = searchOptions.toRestUrl(url, args);
        }

        const request = new GetRequest(this.requestService.generateRequestId(), url);
        return Object.assign(request, {
          getResponseParser(): GenericConstructor<ResponseParsingService> {
            return FacetValueResponseParsingService;
          }
        });
      }),
      configureRequest(this.requestService)
    );

    const requestEntryObs = requestObs.pipe(
      flatMap((request: RestRequest) => this.requestService.getByHref(request.href))
    );

    const responseCacheObs = requestObs.pipe(
      flatMap((request: RestRequest) => this.responseCache.get(request.href))
    );

    // get search results from response cache
    const facetValueObs: Observable<FacetValue[]> = responseCacheObs.pipe(
      map((entry: ResponseCacheEntry) => entry.response),
      map((response: FacetValueSuccessResponse) => response.results)
    );

    const pageInfoObs: Observable<PageInfo> = responseCacheObs.pipe(
      map((entry: ResponseCacheEntry) => entry.response),
      map((response: FacetValueSuccessResponse) => response.pageInfo)
    );

    const payloadObs = Observable.combineLatest(facetValueObs, pageInfoObs, (facetValue, pageInfo) => {
      return new PaginatedList(pageInfo, facetValue);
    });

    return this.rdb.toRemoteDataObservable(requestEntryObs, responseCacheObs, payloadObs);
  }

  getScopes(scopeId: string): Observable<DSpaceObject[]> {

    if (hasNoValue(scopeId)) {
      const top: Observable<Community[]> = this.communityService.findTop({ elementsPerPage: 9999 }).pipe(
        map(
          (communities: RemoteData<PaginatedList<Community>>) => communities.payload.page
        )
      );
      return top;
    }

    const communityScope: Observable<RemoteData<Community>> = this.communityService.findById(scopeId).filter((communityRD: RemoteData<Community>) => !communityRD.isLoading);
    const scopeObject: Observable<DSpaceObject[]> = communityScope.pipe(
      flatMap((communityRD: RemoteData<Community>) => {
          if (hasValue(communityRD.payload)) {
            const community: Community = communityRD.payload;
            // const subcommunities$ = community.subcommunities.filter((subcommunitiesRD: RemoteData<PaginatedList<Community>>) => !subcommunitiesRD.isLoading).first();
            // const collections$ = community.subcommunities.filter((subcommunitiesRD: RemoteData<PaginatedList<Community>>) => !subcommunitiesRD.isLoading).first();
            return Observable.combineLatest(community.subcommunities, community.collections, (subCommunities, collections) => {
              /*if this is a community, we also need to show the direct children*/
              return [community, ...subCommunities.payload.page, ...collections.payload.page]
            })
          } else {
            return this.collectionService.findById(scopeId).pipe(map((collectionRD: RemoteData<Collection>) => [collectionRD.payload]));
          }
        }
      ));

    return scopeObject;

  }

  getFilterLabels(): Observable<FilterLabel[]> {
    return combineLatest(this.getConfig(), this.route.queryParams).pipe(
      map(([rd, params]) => {
        const filterLabels: FilterLabel[] = [];
        rd.payload.forEach((config: SearchFilterConfig) => {
          const param = params[config.paramName];
          if (param !== undefined) {
            if (param instanceof Array && param.length > 1) {
              param.forEach((p: string) => {
                filterLabels.push(new FilterLabel(p, config.paramName))
              });
            } else {
              filterLabels.push(new FilterLabel(param, config.paramName));
            }
          }
        });
        return filterLabels.filter((n) => n !== undefined && n.value.length > 0);
      })
    );
  }

  getViewMode(): Observable<ViewMode> {
    return this.route.queryParams.map((params) => {
      if (isNotEmpty(params.view) && hasValue(params.view)) {
        return params.view;
      } else {
        return ViewMode.List;
      }
    });
  }

  setViewMode(viewMode: ViewMode) {
    const navigationExtras: NavigationExtras = {
      queryParams: { view: viewMode },
      queryParamsHandling: 'merge'
    };

    this.router.navigate([this.getSearchLink()], navigationExtras);
  }

  getSearchLink(): string {
    const urlTree = this.router.parseUrl(this.router.url);
    const g: UrlSegmentGroup = urlTree.root.children[PRIMARY_OUTLET];
    return '/' + g.toString();
  }

  ngOnDestroy(): void {
    if (this.sub !== undefined) {
      this.sub.unsubscribe();
    }
  }
}
