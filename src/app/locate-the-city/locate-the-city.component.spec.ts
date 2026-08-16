import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LocateTheCityComponent } from './locate-the-city.component';

describe('LocateTheCityComponent', () => {
  let component: LocateTheCityComponent;
  let fixture: ComponentFixture<LocateTheCityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocateTheCityComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LocateTheCityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
