import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PopulationmatchComponent } from './populationmatch.component';

describe('PopulationmatchComponent', () => {
  let component: PopulationmatchComponent;
  let fixture: ComponentFixture<PopulationmatchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PopulationmatchComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PopulationmatchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
