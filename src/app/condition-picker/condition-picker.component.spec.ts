import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConditionPickerComponent } from './condition-picker.component';

describe('ConditionPickerComponent', () => {
  let component: ConditionPickerComponent;
  let fixture: ComponentFixture<ConditionPickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConditionPickerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConditionPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
