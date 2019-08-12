import { CreateCollectionPageGuard } from './create-collection-page.guard';
import { MockRouter } from '../../shared/mocks/mock-router';
import { Community } from '../../core/shared/community.model';
import { first } from 'rxjs/operators';
import {
  createFailedRemoteDataObject$,
  createSuccessfulRemoteDataObject$
} from '../../shared/testing/utils';

describe('CreateCollectionPageGuard', () => {
  describe('canActivate', () => {
    let guard: CreateCollectionPageGuard;
    let router;
    let communityDataServiceStub: any;

    beforeEach(() => {
      communityDataServiceStub = {
        findById: (id: string) => {
          if (id === 'valid-id') {
            return createSuccessfulRemoteDataObject$(new Community());
          } else if (id === 'invalid-id') {
            return createSuccessfulRemoteDataObject$(undefined);
          } else if (id === 'error-id') {
            return createFailedRemoteDataObject$(new Community());
          }
        }
      };
      router = new MockRouter();

      guard = new CreateCollectionPageGuard(router, communityDataServiceStub);
    });

    it('should return true when the parent ID resolves to a community', () => {
      guard.canActivate({ queryParams: { parent: 'valid-id' } } as any, undefined)
        .pipe(first())
        .subscribe(
          (canActivate) =>
            expect(canActivate).toEqual(true)
        );
    });

    it('should return false when no parent ID has been provided', () => {
      guard.canActivate({ queryParams: { } } as any, undefined)
        .pipe(first())
        .subscribe(
          (canActivate) =>
            expect(canActivate).toEqual(false)
        );
    });

    it('should return false when the parent ID does not resolve to a community', () => {
      guard.canActivate({ queryParams: { parent: 'invalid-id' } } as any, undefined)
        .pipe(first())
        .subscribe(
          (canActivate) =>
            expect(canActivate).toEqual(false)
        );
    });

    it('should return false when the parent ID resolves to an error response', () => {
      guard.canActivate({ queryParams: { parent: 'error-id' } } as any, undefined)
        .pipe(first())
        .subscribe(
          (canActivate) =>
            expect(canActivate).toEqual(false)
        );
    });
  });
});
