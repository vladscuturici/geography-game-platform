import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WikilocateComponent } from './wikilocate.component';

describe('WikilocateComponent', () => {
  let component: WikilocateComponent;
  let fixture: ComponentFixture<WikilocateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WikilocateComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WikilocateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
