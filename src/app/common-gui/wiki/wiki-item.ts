/* 
    This class is used to store the data of a wiki item.
    It is used in the wiki component to display the wiki items.
*/

import { parser } from "./parser";

export class WikiItem {
    // Replaces NavigatorItem
    id: number | string;
    title_str: string;
    icon: string;
    index: number;
    active: boolean = false;
    content: string;
  
    constructor(id: number | string, index: number, title_str: string, active?: boolean, icon?: string, content?: string) {
      this.id = id;
      this.title_str = title_str;
      this.index = index;
      this.active = active || false;
      this.icon = icon || '/assets/items/compass_01.png';
      this.content = content || '';
    }
  
    get icon_str(): string {
      return this.icon;
    }
  
    get title(): string {
      return this.title_str || '';
    }
  }