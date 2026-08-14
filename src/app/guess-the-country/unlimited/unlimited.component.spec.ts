import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UnlimitedComponent } from './unlimited.component';

describe('UnlimitedComponent', () => {
  let component: UnlimitedComponent;
  let fixture: ComponentFixture<UnlimitedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnlimitedComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UnlimitedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
