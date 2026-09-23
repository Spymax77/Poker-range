(function () {
    'use strict';

    const CONSENT_STORAGE_KEY = 'pfrangetool-cookie-consent';
    const METRIKA_ID = 110799161;
    const METRIKA_SCRIPT_URL = 'https://mc.yandex.ru/metrika/tag.js?id=' + METRIKA_ID;

    const translations = {
        ru: {
            title: 'Использование cookie',
            text: 'Мы используем cookie и Яндекс.Метрику, чтобы улучшать работу сервиса и понимать, как им пользуются. Яндекс.Метрика загрузится только после вашего согласия.',
            privacy: 'Подробнее о конфиденциальности',
            accept: 'Принять',
            reject: 'Отказаться'
        },
        en: {
            title: 'Cookie usage',
            text: 'We use cookies and Yandex.Metrica to improve the service and understand how it is used. Yandex.Metrica will load only after you give consent.',
            privacy: 'Privacy policy',
            accept: 'Accept',
            reject: 'Decline'
        }
    };

    let metrikaLoaded = false;

    function getLanguage() {
        try {
            const savedLanguage = window.localStorage.getItem('pfrangetool-language');
            if (savedLanguage === 'en' || savedLanguage === 'ru') return savedLanguage;
        } catch (error) {
            // Если localStorage недоступен, используем язык браузера.
        }
        return (navigator.language || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
    }

    function hasChoice() {
        try {
            const choice = window.localStorage.getItem(CONSENT_STORAGE_KEY);
            return choice === 'accepted' || choice === 'rejected';
        } catch (error) {
            return false;
        }
    }

    function saveChoice(choice) {
        try {
            window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
        } catch (error) {
            // Выбор действует в текущем сеансе, даже если storage недоступен.
        }
    }

    function loadMetrika() {
        if (metrikaLoaded || typeof window.ym === 'function' && window.ym.l) return;

        metrikaLoaded = true;
        window.ym = window.ym || function () {
            (window.ym.a = window.ym.a || []).push(arguments);
        };
        window.ym.l = 1 * new Date();

        const script = document.createElement('script');
        script.async = true;
        script.src = METRIKA_SCRIPT_URL;
        document.head.appendChild(script);

        window.ym(METRIKA_ID, 'init', {
            ssr: true,
            clickmap: true,
            ecommerce: 'dataLayer',
            referrer: document
        });
    }

    function updateBannerLanguage(banner, language) {
        const text = translations[language];
        if (!text) return;

        banner.querySelector('#cookieConsentTitle').textContent = text.title;
        banner.querySelector('#cookieConsentText').textContent = text.text;
        banner.querySelector('a[href="privacy.html"]').textContent = text.privacy;
        banner.querySelector('.cookie-consent-reject').textContent = text.reject;
        banner.querySelector('.cookie-consent-accept').textContent = text.accept;
    }

    function createBanner() {
        const language = getLanguage();
        const text = translations[language];
        const banner = document.createElement('section');
        banner.className = 'cookie-consent';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-labelledby', 'cookieConsentTitle');
        banner.setAttribute('aria-describedby', 'cookieConsentText');
        banner.innerHTML = `
            <div class="cookie-consent-content">
                <h2 id="cookieConsentTitle">${text.title}</h2>
                <p id="cookieConsentText">${text.text}</p>
                <a href="privacy.html" target="_blank" rel="noopener noreferrer">${text.privacy}</a>
            </div>
            <div class="cookie-consent-actions">
                <button class="cookie-consent-reject" type="button">${text.reject}</button>
                <button class="cookie-consent-accept" type="button">${text.accept}</button>
            </div>
        `;

        banner.querySelector('.cookie-consent-accept').addEventListener('click', function () {
            saveChoice('accepted');
            loadMetrika();
            banner.classList.add('cookie-consent-hiding');
            window.setTimeout(function () {
                banner.remove();
            }, 220);
        });

        banner.querySelector('.cookie-consent-reject').addEventListener('click', function () {
            saveChoice('rejected');
            banner.classList.add('cookie-consent-hiding');
            window.setTimeout(function () {
                banner.remove();
            }, 220);
        });

        document.body.appendChild(banner);
        document.addEventListener('languagechange', function (event) {
            const language = event.detail && event.detail.language;
            updateBannerLanguage(banner, language);
        });
    }

    if (hasChoice()) {
        let choice = null;
        try {
            choice = window.localStorage.getItem(CONSENT_STORAGE_KEY);
        } catch (error) {
            choice = null;
        }
        if (choice === 'accepted') {
            loadMetrika();
        }
    } else {
        createBanner();
    }
})();