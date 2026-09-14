import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Country21OnlineComponent } from './country21-online.component';

describe('Country21OnlineComponent', () => {
  let component: Country21OnlineComponent;
  let fixture: ComponentFixture<Country21OnlineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Country21OnlineComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(Country21OnlineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
