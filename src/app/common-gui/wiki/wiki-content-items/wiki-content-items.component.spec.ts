import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WikiContentItemsComponent } from './wiki-content-items.component';

describe('WikiContentItemsComponent', () => {
  let component: WikiContentItemsComponent;
  let fixture: ComponentFixture<WikiContentItemsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WikiContentItemsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(WikiContentItemsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
