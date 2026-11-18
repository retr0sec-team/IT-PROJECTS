(() => {
 const btn=document.querySelector('.menu-toggle'),nav=document.querySelector('.main-nav');
 if(btn&&nav){btn.addEventListener('click',()=>{const open=nav.classList.toggle('open');btn.setAttribute('aria-expanded',String(open));btn.textContent=open?'×':'☰';});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');btn.setAttribute('aria-expanded','false');btn.textContent='☰';}));}
 const year=document.getElementById('year');if(year)year.textContent=new Date().getFullYear();
 const form=document.getElementById('interest-form'),feedback=document.getElementById('form-feedback');
 if(form&&feedback)form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;feedback.textContent='DEMO: formulario validado. Las reservas reales se habilitarán al conectar el backend.';feedback.style.color='#69f7b3';});
})();