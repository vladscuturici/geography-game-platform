import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailyCountryComponent } from './daily-country.component';

describe('DailyCountryComponent', () => {
  let component: DailyCountryComponent;
  let fixture: ComponentFixture<DailyCountryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DailyCountryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DailyCountryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
