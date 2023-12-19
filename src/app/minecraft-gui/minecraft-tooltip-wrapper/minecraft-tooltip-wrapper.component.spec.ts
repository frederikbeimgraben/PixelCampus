import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MinecraftTooltipWrapperComponent } from './minecraft-tooltip-wrapper.component';

describe('MinecraftTooltipWrapperComponent', () => {
  let component: MinecraftTooltipWrapperComponent;
  let fixture: ComponentFixture<MinecraftTooltipWrapperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MinecraftTooltipWrapperComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MinecraftTooltipWrapperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
