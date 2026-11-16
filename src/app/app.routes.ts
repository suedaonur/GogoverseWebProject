import { Routes } from '@angular/router';
import { MainLayout } from './layouts/main-layout/main-layout';

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: '',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
        title: 'GÖGÖVERSE WEB',
        data: {
          pageTitle: 'Ana Sayfa',
          pageDescription: 'GÖGÖVERSE yayın ve içerik yönetim merkezine genel bakış.',
        },
      },
      {
        path: 'icerikler',
        loadComponent: () => import('./features/contents/contents').then((m) => m.Contents),
        title: 'İçerikler | GÖGÖVERSE WEB',
        data: {
          pageTitle: 'İçerikler',
          pageDescription: 'Yayınlarını, etkinliklerini ve sosyal medya içeriklerini yönet.',
        },
      },
      {
        path: 'icerikler/:id',
        loadComponent: () =>
          import('./features/contents/content-detail/content-detail').then((m) => m.ContentDetail),
        title: 'İçerik Detayı | GÖGÖVERSE WEB',
        data: {
          pageTitle: 'İçerik Detayı',
          pageDescription: 'Yayın ve içerik bilgilerini incele.',
        },
      },
      {
        path: 'takvim',
        loadComponent: () => import('./features/calendar/calendar').then((m) => m.Calendar),
        title: 'Takvim | GÖGÖVERSE WEB',
        data: {
          pageTitle: 'Takvim',
          pageDescription:
            'Yayınlarını, etkinliklerini ve içerik planlarını takvim üzerinden takip et.',
        },
      },
      {
        path: 'arsiv',
        loadComponent: () => import('./features/archive/archive').then((m) => m.Archive),
        title: 'İçerik Arşivi | GÖGÖVERSE WEB',
        data: {
          pageTitle: 'İçerik Arşivi',
          pageDescription:
            'Tamamladığın yayınları, etkinlikleri ve sosyal medya içeriklerini incele.',
        },
      },
      {
        path: 'gorevler',
        loadComponent: () => import('./features/todos/todos').then((m) => m.Todos),
        title: 'Görevlerim | GÖGÖVERSE WEB',
        data: {
          pageTitle: 'Görevlerim',
          pageDescription: 'Yapılacak işlerini planla, takip et ve tamamladıklarını yönet.',
        },
      },
      {
        path: 'taslaklar',
        loadComponent: () => import('./features/drafts/drafts').then((m) => m.Drafts),
        title: 'Metin Taslakları | GÖGÖVERSE WEB',
        data: {
          pageTitle: 'Metin Taslakları',
          pageDescription:
            'Yayınların ve sosyal medya içeriklerin için platforma özel metinler oluştur.',
        },
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
