import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CountrybingoComponent } from './countrybingo.component';

describe('CountrybingoComponent', () => {
  let component: CountrybingoComponent;
  let fixture: ComponentFixture<CountrybingoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CountrybingoComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CountrybingoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
