import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GuessTheCountryShellComponent } from './guess-the-country-shell.component';

describe('GuessTheCountryShellComponent', () => {
  let component: GuessTheCountryShellComponent;
  let fixture: ComponentFixture<GuessTheCountryShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuessTheCountryShellComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GuessTheCountryShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
