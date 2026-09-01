import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TicTacToeOnlineComponent } from './tic-tac-toe-online.component';

describe('TicTacToeOnlineComponent', () => {
  let component: TicTacToeOnlineComponent;
  let fixture: ComponentFixture<TicTacToeOnlineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicTacToeOnlineComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TicTacToeOnlineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
