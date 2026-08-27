import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WavelengthComponent } from './wavelength.component';

describe('WavelengthComponent', () => {
  let component: WavelengthComponent;
  let fixture: ComponentFixture<WavelengthComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WavelengthComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WavelengthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
