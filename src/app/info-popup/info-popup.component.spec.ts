import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InfoPopupComponent } from './info-popup.component';

describe('InfoPopupComponent', () => {
  let component: InfoPopupComponent;
  let fixture: ComponentFixture<InfoPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfoPopupComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InfoPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
