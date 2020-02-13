import { autoserialize, deserialize, inheritSerialization } from 'cerialize';
import { resourceType } from '../cache/builders/build-decorators';
import { CacheableObject } from '../cache/object-cache.reducer';
import { excludeFromEquals } from '../utilities/equals.decorators';
import { EXTERNAL_SOURCE } from './external-source.resource-type';
import { HALLink } from './hal-link.model';
import { ResourceType } from './resource-type';

/**
 * Model class for an external source
 */
@resourceType(ExternalSource.type)
export class ExternalSource extends CacheableObject {
  static type = EXTERNAL_SOURCE;

  /**
   * The object type
   */
  @excludeFromEquals
  @autoserialize
  type: ResourceType;

  /**
   * Unique identifier
   */
  @autoserialize
  id: string;

  /**
   * The name of this external source
   */
  @autoserialize
  name: string;

  /**
   * Is the source hierarchical?
   */
  @autoserialize
  hierarchical: boolean;

  @deserialize
  _links: {
    self: HALLink;
    entries: HALLink;
  }
}
