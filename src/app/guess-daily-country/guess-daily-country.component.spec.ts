import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GuessDailyCountryComponent } from './guess-daily-country.component';

describe('GuessDailyCountryComponent', () => {
  let component: GuessDailyCountryComponent;
  let fixture: ComponentFixture<GuessDailyCountryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuessDailyCountryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GuessDailyCountryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
