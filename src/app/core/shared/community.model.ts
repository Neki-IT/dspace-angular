import { autoserialize, deserialize, inheritSerialization } from 'cerialize';
import { Observable } from 'rxjs';
import { link, resourceType } from '../cache/builders/build-decorators';
import { PaginatedList } from '../data/paginated-list';
import { RemoteData } from '../data/remote-data';
import { Bitstream } from './bitstream.model';
import { BITSTREAM } from './bitstream.resource-type';
import { Collection } from './collection.model';
import { COLLECTION } from './collection.resource-type';
import { COMMUNITY } from './community.resource-type';
import { DSpaceObject } from './dspace-object.model';
import { HALLink } from './hal-link.model';

@resourceType(Community.type)
@inheritSerialization(DSpaceObject)
export class Community extends DSpaceObject {
  static type = COMMUNITY;

  /**
   * A string representing the unique handle of this Community
   */
  @autoserialize
  handle: string;

  /**
   * The HALLinks for this Community
   */
  @deserialize
  _links: {
    collections: HALLink;
    logo: HALLink;
    subcommunities: HALLink;
    self: HALLink;
  };

  /**
   * The logo for this Community
   * Will be undefined unless the logo HALLink has been resolved.
   */
  @link(BITSTREAM)
  logo?: Observable<RemoteData<Bitstream>>;

  /**
   * The list of Collections that are direct children of this Community
   * Will be undefined unless the collections HALLink has been resolved.
   */
  @link(COLLECTION, true)
  collections?: Observable<RemoteData<PaginatedList<Collection>>>;

  /**
   * The list of Communities that are direct children of this Community
   * Will be undefined unless the subcommunities HALLink has been resolved.
   */
  @link(COMMUNITY, true)
  subcommunities?: Observable<RemoteData<PaginatedList<Community>>>;

  /**
   * The introductory text of this Community
   * Corresponds to the metadata field dc.description
   */
  get introductoryText(): string {
    return this.firstMetadataValue('dc.description');
  }

  /**
   * The short description: HTML
   * Corresponds to the metadata field dc.description.abstract
   */
  get shortDescription(): string {
    return this.firstMetadataValue('dc.description.abstract');
  }

  /**
   * The copyright text of this Community
   * Corresponds to the metadata field dc.rights
   */
  get copyrightText(): string {
    return this.firstMetadataValue('dc.rights');
  }

  /**
   * The sidebar text of this Community
   * Corresponds to the metadata field dc.description.tableofcontents
   */
  get sidebarText(): string {
    return this.firstMetadataValue('dc.description.tableofcontents');
  }
}
