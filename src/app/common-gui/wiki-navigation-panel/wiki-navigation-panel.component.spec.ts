import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WikiNavigationPanelComponent } from './wiki-navigation-panel.component';

describe('WikiNavigationPanelComponent', () => {
  let component: WikiNavigationPanelComponent;
  let fixture: ComponentFixture<WikiNavigationPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WikiNavigationPanelComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(WikiNavigationPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
