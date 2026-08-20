// condition-picker/condition-picker.component.ts
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  CATEGORY_LABELS,
  CONDITION_RECORDS,
  ConditionCategory,
  ConditionRecord,
} from '../conditions/condition-records';

@Component({
  selector: 'app-condition-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './condition-picker.component.html',
  styleUrl: './condition-picker.component.css',
})
export class ConditionPickerComponent {
  /** Ids already used elsewhere on the board — greyed out / disabled here. */
  @Input() excludeIds: string[] = [];

  @Output() picked = new EventEmitter<ConditionRecord>();
  @Output() dismissed = new EventEmitter<void>();

  public categories = Object.values(ConditionCategory);
  public categoryLabels = CATEGORY_LABELS;
  public activeCategory: ConditionCategory = this.categories[0];

  public get visibleRecords(): ConditionRecord[] {
    return CONDITION_RECORDS.filter(r => r.category === this.activeCategory);
  }

  public isDisabled(record: ConditionRecord): boolean {
    return this.excludeIds.includes(record.id);
  }

  public selectCategory(category: ConditionCategory): void {
    this.activeCategory = category;
  }

  public choose(record: ConditionRecord): void {
    if (this.isDisabled(record)) return;
    this.picked.emit(record);
  }

  public onBackdropClick(): void {
    this.dismissed.emit();
  }

  public stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}