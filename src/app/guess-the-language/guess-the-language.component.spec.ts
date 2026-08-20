import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GuessTheLanguageComponent } from './guess-the-language.component';

describe('GuessTheLanguageComponent', () => {
  let component: GuessTheLanguageComponent;
  let fixture: ComponentFixture<GuessTheLanguageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuessTheLanguageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GuessTheLanguageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
