import { Component } from '@angular/core';
import { ThemedComponent } from '../shared/theme-support/themed.component';
import { CommunityPageComponent } from './community-page.component';

@Component({
  selector: 'ds-themed-community-page',
  styleUrls: [],
  templateUrl: '../shared/theme-support/themed.component.html',
})

/**
 * Component to render the news section on the home page
 */
export class ThemedCommunityPageComponent extends ThemedComponent<CommunityPageComponent> {
  protected getComponentName(): string {
    return 'CommunityPageComponent';
  }

  protected importThemedComponent(themeName: string): Promise<any> {
    return import(`../../themes/${themeName}/app/+community-page/community-page.component`);
  }

  protected importUnthemedComponent(): Promise<any> {
    return import(`./community-page.component`);
  }

}
