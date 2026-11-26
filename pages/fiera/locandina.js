document.querySelector('.poster-back').addEventListener('click',event=>{
  // Se aperta direttamente, il collegamento resta un ritorno sicuro alla Fiera.
  if(document.referrer){
    const previous=new URL(document.referrer),fiera=new URL('index.html',location.href);
    if(previous.origin===fiera.origin&&previous.pathname===fiera.pathname&&history.length>1){event.preventDefault();history.back();}
  }
});
function updatePosterLabel() {
  const button = document.querySelector('#poster-zoom');
  const enlarged = document.body.classList.contains('poster-enlarged');
  const en = document.documentElement.lang === 'en';
  button.setAttribute('aria-pressed', String(enlarged));
  button.textContent = en ? (enlarged ? 'Show the whole poster' : 'Enlarge poster') : (enlarged ? 'Mostra tutta la locandina' : 'Ingrandisci locandina');
}
document.querySelector('#poster-zoom').addEventListener('click', () => { document.body.classList.toggle('poster-enlarged'); updatePosterLabel(); });
document.addEventListener('totem-language', updatePosterLabel);
