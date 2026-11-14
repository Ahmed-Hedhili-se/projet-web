import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RecommendationRequest, RecommendationResponse } from '../models/recommendation';

@Injectable({ providedIn: 'root' })
export class RecommendationService {
  private readonly http = inject(HttpClient);

  recommend(request: RecommendationRequest): Observable<RecommendationResponse> {
    return this.http.post<RecommendationResponse>(`${environment.apiUrl}/recommendations`, request);
  }
}
