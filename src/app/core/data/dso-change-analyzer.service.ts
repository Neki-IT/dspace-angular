import { Operation } from 'fast-json-patch/lib/core';
import { compare } from 'fast-json-patch';
import { ChangeAnalyzer } from './change-analyzer';
import { NormalizedDSpaceObject } from '../cache/models/normalized-dspace-object.model';
import { Injectable } from '@angular/core';
import { DSpaceObject } from '../shared/dspace-object.model';

/**
 * A class to determine what differs between two
 * DSpaceObjects
 */
@Injectable()
export class DSOChangeAnalyzer<T extends DSpaceObject> implements ChangeAnalyzer<T> {

  /**
   * Compare the metadata of two DSpaceObjects and return the differences as
   * a JsonPatch Operation Array
   *
   * @param {DSpaceObject} object1
   *    The first object to compare
   * @param {DSpaceObject} object2
   *    The second object to compare
   */
  diff(object1: DSpaceObject, object2: DSpaceObject): Operation[] {
    return compare(object1.metadata, object2.metadata).map((operation: Operation) => Object.assign({}, operation, { path: '/metadata' + operation.path }));
  }
}
