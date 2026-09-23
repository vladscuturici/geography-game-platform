import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CountrybingoOnlineComponent } from './countrybingo-online.component';

describe('CountrybingoOnlineComponent', () => {
  let component: CountrybingoOnlineComponent;
  let fixture: ComponentFixture<CountrybingoOnlineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CountrybingoOnlineComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CountrybingoOnlineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
