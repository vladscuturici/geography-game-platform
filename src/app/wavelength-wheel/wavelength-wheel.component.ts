import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WavelengthCategory } from '../categories/wavelength.categories';

export type WheelPhase = 'psychic' | 'guesser' | 'reveal';

const RED_WIDTH = 5;
const GREEN_WIDTH = 12;
const YELLOW_WIDTH = 20;

@Component({
  selector: 'app-wavelength-wheel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wavelength-wheel.component.html',
  styleUrl: './wavelength-wheel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WavelengthWheelComponent {
  @Input() category!: WavelengthCategory;
  @Input() target = 50;
  @Input() needleValue = 50;
  @Input() phase: WheelPhase = 'psychic';
  @Input() coverValue = 0;
  @Input() lockedGuess: number | null = null;

  @Output() needleValueChange = new EventEmitter<number>();

  private wheelEl: HTMLElement | null = null;

  // --- Zone geometry (derived purely from `target`, same math as before) ---
  public get redZone(): { from: number; to: number } {
    return {
      from: Math.max(0, this.target - RED_WIDTH),
      to: Math.min(100, this.target + RED_WIDTH),
    };
  }

  public get greenZoneLeft(): { from: number; to: number } {
    return {
      from: Math.max(0, this.target - GREEN_WIDTH),
      to: Math.max(0, this.target - RED_WIDTH),
    };
  }

  public get greenZoneRight(): { from: number; to: number } {
    return {
      from: Math.min(100, this.target + RED_WIDTH),
      to: Math.min(100, this.target + GREEN_WIDTH),
    };
  }

  public get yellowZoneLeft(): { from: number; to: number } {
    return {
      from: Math.max(0, this.target - YELLOW_WIDTH),
      to: Math.max(0, this.target - GREEN_WIDTH),
    };
  }

  public get yellowZoneRight(): { from: number; to: number } {
    return {
      from: Math.min(100, this.target + GREEN_WIDTH),
      to: Math.min(100, this.target + YELLOW_WIDTH),
    };
  }

  public valueToAngle(value: number): number {
    const v = Math.min(100, Math.max(0, value));
    return 180 - v * 1.8;
  }

  public wedgePath(from: number, to: number, cx = 150, cy = 150, r = 140): string {
    if (to <= from) return '';
    const a1 = this.valueToAngle(from);
    const a2 = this.valueToAngle(to);

    // Sample the arc as short straight segments instead of using an SVG "A"
    // command — see original comment: at large spans the sweep-flag
    // resolution can pick the wrong circle and produce an inward spike.
    const steps = Math.max(2, Math.ceil(Math.abs(a1 - a2) / 4));
    let d = `M ${cx} ${cy}`;
    for (let i = 0; i <= steps; i++) {
      const angle = a1 + ((a2 - a1) * i) / steps;
      const p = this.polar(cx, cy, r, angle);
      d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    }
    d += ' Z';
    return d;
  }

  private polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy - r * Math.sin(rad),
    };
  }

  public needleTransform(value: number, cx = 150, cy = 150): string {
    const angle = this.valueToAngle(value);
    const rotation = 90 - angle;
    return `rotate(${rotation} ${cx} ${cy})`;
  }

  // --- Drag handling ---
  public onDragStart(event: PointerEvent, el: HTMLElement): void {
    if (this.phase !== 'guesser') return;
    this.wheelEl = el;
    this.updateFromPointer(event);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  public onDragMove(event: PointerEvent): void {
    if (this.phase !== 'guesser') return;
    if (event.buttons === 0 && event.pointerType === 'mouse') return;
    this.updateFromPointer(event);
  }

  private updateFromPointer(event: PointerEvent): void {
    if (!this.wheelEl) return;
    const rect = this.wheelEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.bottom;
    const dx = event.clientX - cx;
    const dy = cy - event.clientY;
    let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    // See original comment: atan2's negative range needs to snap to the
    // correct edge based on which side of center the pointer is on.
    if (angleDeg < 0) {
      angleDeg = dx < 0 ? 180 : 0;
    } else {
      angleDeg = Math.min(180, angleDeg);
    }

    const value = Math.round((180 - angleDeg) / 1.8);
    const clamped = Math.min(100, Math.max(0, value));
    this.needleValueChange.emit(clamped);
  }
}