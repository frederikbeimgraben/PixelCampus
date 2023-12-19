import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MinecraftBannerComponent } from './minecraft-banner.component';

describe('MinecraftBannerComponent', () => {
  let component: MinecraftBannerComponent;
  let fixture: ComponentFixture<MinecraftBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MinecraftBannerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MinecraftBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
