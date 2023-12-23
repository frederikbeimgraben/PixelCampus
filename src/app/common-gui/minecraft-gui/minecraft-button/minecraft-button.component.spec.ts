import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MinecraftButtonComponent } from './minecraft-button.component';

describe('MinecraftButtonComponent', () => {
  let component: MinecraftButtonComponent;
  let fixture: ComponentFixture<MinecraftButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MinecraftButtonComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MinecraftButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
