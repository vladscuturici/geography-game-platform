import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Country21Component } from './country21.component';

describe('Country21Component', () => {
  let component: Country21Component;
  let fixture: ComponentFixture<Country21Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Country21Component],
    }).compileComponents();

    fixture = TestBed.createComponent(Country21Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
