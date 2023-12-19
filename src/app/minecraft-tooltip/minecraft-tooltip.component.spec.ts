import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MinecraftTooltipComponent } from './minecraft-tooltip.component';

describe('MinecraftTooltipComponent', () => {
  let component: MinecraftTooltipComponent;
  let fixture: ComponentFixture<MinecraftTooltipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MinecraftTooltipComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MinecraftTooltipComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
