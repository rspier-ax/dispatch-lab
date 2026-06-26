import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('enqueues success toast', () => {
    service.success('Operação concluída.');
    expect(service.messages().length).toBe(1);
    expect(service.messages()[0].tone).toBe('success');
    expect(service.messages()[0].message).toBe('Operação concluída.');
  });

  it('replaces toast by id for loading sequence', () => {
    const id = 'scenario-apply';
    service.loading('Aplicando…', { id });
    expect(service.messages()[0].tone).toBe('loading');

    service.success('Cenário aplicado.', { id });
    expect(service.messages().length).toBe(1);
    expect(service.messages()[0].tone).toBe('success');
    expect(service.messages()[0].message).toBe('Cenário aplicado.');
  });

  it('dismisses toast manually', fakeAsync(() => {
    const id = service.info('Info');
    service.dismiss(id);
    expect(service.messages().length).toBe(0);
    tick(5000);
  }));

  it('auto-dismisses success toast', fakeAsync(() => {
    service.success('Ok', { duration: 1000 });
    expect(service.messages().length).toBe(1);
    tick(1000);
    expect(service.messages().length).toBe(0);
  }));
});
