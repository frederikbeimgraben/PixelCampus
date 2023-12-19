import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MinecraftPopupComponent } from './minecraft-popup.component';

describe('MinecraftPopupComponent', () => {
  let component: MinecraftPopupComponent;
  let fixture: ComponentFixture<MinecraftPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MinecraftPopupComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MinecraftPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
