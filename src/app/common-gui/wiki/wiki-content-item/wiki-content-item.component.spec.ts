import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WikiContentItemComponent } from './wiki-content-item.component';

describe('WikiContentItemComponent', () => {
  let component: WikiContentItemComponent;
  let fixture: ComponentFixture<WikiContentItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WikiContentItemComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(WikiContentItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
