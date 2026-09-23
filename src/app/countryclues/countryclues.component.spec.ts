import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CountrycluesComponent } from './countryclues.component';

describe('CountrycluesComponent', () => {
  let component: CountrycluesComponent;
  let fixture: ComponentFixture<CountrycluesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CountrycluesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CountrycluesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
