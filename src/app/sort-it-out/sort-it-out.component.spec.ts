import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SortItOutComponent } from './sort-it-out.component';

describe('SortItOutComponent', () => {
  let component: SortItOutComponent;
  let fixture: ComponentFixture<SortItOutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SortItOutComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SortItOutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
