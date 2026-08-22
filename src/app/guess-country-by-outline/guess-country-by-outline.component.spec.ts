import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GuessCountryByOutlineComponent } from './guess-country-by-outline.component';

describe('GuessCountryByOutlineComponent', () => {
  let component: GuessCountryByOutlineComponent;
  let fixture: ComponentFixture<GuessCountryByOutlineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuessCountryByOutlineComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GuessCountryByOutlineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
