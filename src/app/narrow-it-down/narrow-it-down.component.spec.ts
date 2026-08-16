import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NarrowItDownComponent } from './narrow-it-down.component';

describe('NarrowItDownComponent', () => {
  let component: NarrowItDownComponent;
  let fixture: ComponentFixture<NarrowItDownComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NarrowItDownComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NarrowItDownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
