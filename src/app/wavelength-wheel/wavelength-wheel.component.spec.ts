import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WavelengthWheelComponent } from './wavelength-wheel.component';

describe('WavelengthWheelComponent', () => {
  let component: WavelengthWheelComponent;
  let fixture: ComponentFixture<WavelengthWheelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WavelengthWheelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WavelengthWheelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
