const initialize_scrollspy = () => {
    const heading_selector = 'h2[id], h3[id], h4[id], h5[id], h6[id]';
    const toc_link_selector = '#TableOfContents li a';
    
    const observer_options = {
        rootMargin: '0px 0px -80% 0px',
        threshold: 0
    };

    const update_active_link = (entries) => {
        entries.forEach(entry => {
            const id = entry.target.getAttribute('id');
            const link = document.querySelector(`${toc_link_selector}[href="#${id}"]`);
            
            if (entry.isIntersecting) {
                document.querySelectorAll(toc_link_selector).forEach(nav => {
                    nav.classList.remove('active');
                });
                if (link) {
                    link.classList.add('active');
                }
            }
        });
    };

    const section_observer = new IntersectionObserver(update_active_link, observer_options);

    document.querySelectorAll(heading_selector).forEach((section) => {
        section_observer.observe(section);
    });
};

window.addEventListener('DOMContentLoaded', initialize_scrollspy);