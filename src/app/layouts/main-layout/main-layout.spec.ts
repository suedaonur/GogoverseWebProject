import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MainLayout } from './main-layout';
import { routes } from '../../app.routes';

describe('MainLayout', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [provideRouter(routes)],
    }).compileComponents();
    harness = await RouterTestingHarness.create('/');
    el = harness.routeNativeElement as HTMLElement;
  });

  it('should render brand, router outlet, right-side banner showcase, and the Home page inside the layout', () => {
    expect(el.querySelector('.brand-name')?.textContent).toContain('GÖGÖVERSE WEB');
    expect(el.querySelector('router-outlet')).toBeTruthy();
    expect(el.querySelector('main app-home')).toBeTruthy();
    expect(el.querySelector('h1')?.textContent).toContain('Ana Sayfa');
    const bannerImg = el.querySelector('.workspace-banner-aside img.side-banner-img') as HTMLImageElement;
    expect(bannerImg).toBeTruthy();
    expect(bannerImg.getAttribute('src')).toBe('assets/banner.webp');
    expect(el.querySelectorAll('.side-banner-platforms .platform-logo').length).toBe(4);
    const photo = el.querySelector('.workspace-banner-aside img.side-banner-photo') as HTMLImageElement;
    expect(photo).toBeTruthy();
    expect(photo.getAttribute('src')).toBe('assets/banner-iki.webp');
    const photoCard = photo.closest('.side-banner-photo-card') as HTMLElement;
    expect(photoCard.textContent?.trim()).toBe('');
    expect(photoCard.querySelector('h2, p, .tag-badge, .platform-badge, a, button')).toBeNull();
  });

  it('should render both banners in the shared aside on all six main routes with the sidebar links intact', async () => {
    for (const url of ['/', '/icerikler', '/takvim', '/arsiv', '/gorevler', '/taslaklar']) {
      await harness.navigateByUrl(url);
      harness.detectChanges();
      expect(el.querySelectorAll('.workspace-banner-aside').length).toBe(1);
      const imgs = Array.from(el.querySelectorAll('.workspace-banner-aside img')).map((i) =>
        i.getAttribute('src'),
      );
      expect(imgs).toContain('assets/banner.webp');
      expect(imgs).toContain('assets/banner-iki.webp');
      expect(el.querySelectorAll('a.nav-item').length).toBe(6);
    }
  });

  it('should link Ana Sayfa to / and mark it active', () => {
    const link = el.querySelector('a.nav-item') as HTMLAnchorElement;
    expect(link.textContent).toContain('Ana Sayfa');
    expect(link.getAttribute('href')).toBe('/');
    expect(link.classList).toContain('is-active');
    expect(link.getAttribute('aria-current')).toBe('page');
  });

  it('should show all 6 navigation modules as active links with no Yakında disabled items remaining', () => {
    const disabled = el.querySelectorAll('.nav-item.is-disabled');
    expect(disabled.length).toBe(0);
    const links = el.querySelectorAll('a.nav-item');
    expect(links.length).toBe(6);
  });

  it('should link İçerikler to /icerikler, Takvim to /takvim, Arşiv to /arsiv, Görevlerim to /gorevler, and Metin Taslakları to /taslaklar and update header on navigation', async () => {
    const links = Array.from(el.querySelectorAll('a.nav-item')) as HTMLAnchorElement[];
    const contentsLink = links.find((a) => a.textContent?.includes('İçerikler'));
    const calendarLink = links.find((a) => a.textContent?.includes('Takvim'));
    const archiveLink = links.find((a) => a.textContent?.includes('Arşiv'));
    const todosLink = links.find((a) => a.textContent?.includes('Görevlerim'));
    const draftsLink = links.find((a) => a.textContent?.includes('Metin Taslakları'));
    expect(contentsLink?.getAttribute('href')).toBe('/icerikler');
    expect(calendarLink?.getAttribute('href')).toBe('/takvim');
    expect(archiveLink?.getAttribute('href')).toBe('/arsiv');
    expect(todosLink?.getAttribute('href')).toBe('/gorevler');
    expect(draftsLink).toBeTruthy();
    expect(draftsLink?.getAttribute('href')).toBe('/taslaklar');
    expect(draftsLink?.textContent).not.toContain('Yakında');

    await harness.navigateByUrl('/icerikler');
    harness.detectChanges();
    expect(contentsLink?.classList).toContain('is-active');
    expect(el.querySelector('h1')?.textContent).toContain('İçerikler');
    expect(el.querySelector('.page-description')?.textContent).toContain(
      'Yayınlarını, etkinliklerini ve sosyal medya içeriklerini yönet.',
    );
    expect(el.querySelector('main app-contents')).toBeTruthy();

    await harness.navigateByUrl('/takvim');
    harness.detectChanges();
    expect(calendarLink?.classList).toContain('is-active');
    expect(el.querySelector('h1')?.textContent).toContain('Takvim');
    expect(el.querySelector('.page-description')?.textContent).toContain(
      'Yayınlarını, etkinliklerini ve içerik planlarını takvim üzerinden takip et.',
    );
    expect(el.querySelector('main app-calendar')).toBeTruthy();

    await harness.navigateByUrl('/arsiv');
    harness.detectChanges();
    expect(archiveLink?.classList).toContain('is-active');
    expect(el.querySelector('h1')?.textContent).toContain('İçerik Arşivi');
    expect(el.querySelector('.page-description')?.textContent).toContain(
      'Tamamladığın yayınları, etkinlikleri ve sosyal medya içeriklerini incele.',
    );
    expect(el.querySelector('main app-archive')).toBeTruthy();

    await harness.navigateByUrl('/gorevler');
    harness.detectChanges();
    expect(todosLink?.classList).toContain('is-active');
    expect(el.querySelector('h1')?.textContent).toContain('Görevlerim');
    expect(el.querySelector('.page-description')?.textContent).toContain(
      'Yapılacak işlerini planla, takip et ve tamamladıklarını yönet.',
    );
    expect(el.querySelector('main app-todos')).toBeTruthy();

    await harness.navigateByUrl('/taslaklar');
    harness.detectChanges();
    expect(draftsLink?.classList).toContain('is-active');
    expect(el.querySelector('h1')?.textContent).toContain('Metin Taslakları');
    expect(el.querySelector('.page-description')?.textContent).toContain(
      'Yayınların ve sosyal medya içeriklerin için platforma özel metinler oluştur.',
    );
    expect(el.querySelector('main app-drafts')).toBeTruthy();
  });

  it('should open and close the mobile menu with correct ARIA state', () => {
    const button = el.querySelector('button[aria-controls="sidebar"]') as HTMLButtonElement;
    const sidebar = el.querySelector('#sidebar') as HTMLElement;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(sidebar.classList).not.toContain('is-open');

    button.click();
    harness.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(sidebar.classList).toContain('is-open');

    (el.querySelector('button[aria-label="Menüyü kapat"]') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(sidebar.classList).not.toContain('is-open');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('should close the mobile menu with Escape and with a backdrop click', () => {
    const button = el.querySelector('button[aria-controls="sidebar"]') as HTMLButtonElement;
    const sidebar = el.querySelector('#sidebar') as HTMLElement;

    button.click();
    harness.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    harness.detectChanges();
    expect(sidebar.classList).not.toContain('is-open');

    button.click();
    harness.detectChanges();
    (el.querySelector('.backdrop') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(sidebar.classList).not.toContain('is-open');
  });
});
