import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Directive, ElementRef, Input, OnChanges, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { SessionService } from './session.service';

@Directive({
  selector: 'img[appAuthenticatedSrc]',
  standalone: true
})
export class AuthenticatedImageDirective implements OnChanges, OnDestroy {
  private readonly element = inject<ElementRef<HTMLImageElement>>(ElementRef);
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  @Input() public appAuthenticatedSrc: string | null | undefined;
  @Input() public previewSrc: string | null | undefined;

  private request?: Subscription;
  private objectUrl?: string;

  public ngOnChanges(): void {
    this.request?.unsubscribe();
    this.revokeObjectUrl();

    if (!this.appAuthenticatedSrc || !this.session.value) {
      this.element.nativeElement.src = this.previewSrc || '';
      return;
    }

    this.request = this.http.get(this.appAuthenticatedSrc, {
      headers: new HttpHeaders({ Authorization: `Bearer ${this.session.value}` }),
      responseType: 'blob'
    }).subscribe({
      next: blob => {
        this.objectUrl = URL.createObjectURL(blob);
        this.element.nativeElement.src = this.objectUrl;
      },
      error: () => {
        this.element.nativeElement.src = this.previewSrc || '';
      }
    });
  }

  public ngOnDestroy(): void {
    this.request?.unsubscribe();
    this.revokeObjectUrl();
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = undefined;
    }
  }
}
