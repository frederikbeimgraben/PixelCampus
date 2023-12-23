import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LatencyComponent } from './latency.component';

describe('LatencyComponent', () => {
  let component: LatencyComponent;
  let fixture: ComponentFixture<LatencyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LatencyComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LatencyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
