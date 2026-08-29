import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WavelengthOnlineComponent } from './wavelength-online.component';

describe('WavelengthOnlineComponent', () => {
  let component: WavelengthOnlineComponent;
  let fixture: ComponentFixture<WavelengthOnlineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WavelengthOnlineComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WavelengthOnlineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
