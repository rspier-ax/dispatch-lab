import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConnectionIndicatorComponent } from './connection-indicator.component';

describe('ConnectionIndicatorComponent', () => {
  let fixture: ComponentFixture<ConnectionIndicatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConnectionIndicatorComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ConnectionIndicatorComponent);
  });

  it('shows connected label', () => {
    fixture.componentRef.setInput('state', 'connected');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Conectado');
  });

  it('shows reconnecting label', () => {
    fixture.componentRef.setInput('state', 'reconnecting');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reconectando');
  });
});
