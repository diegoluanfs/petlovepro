"""Make local 300x250 JPEG promotional images, without uploading content."""
from pathlib import Path
from PIL import Image, ImageOps
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'public'/'assets'/'covers'
DST=ROOT/'private'/'kiwify-product-images'

def main():
    items=[(f'{n:03}',f'book-{n:03}.webp') for n in range(1,51)]
    items += [('nutricao-natural' if n==1 else f'colecao-{n:02}',f'collection-{n:02}.webp') for n in range(1,11)]
    DST.mkdir(parents=True,exist_ok=True)
    for id,name in items:
        file=SRC/name
        if file.is_symlink(): raise ValueError(f'Link simbólico recusado: {name}')
        with Image.open(file) as im:
            if im.format!='WEBP': raise ValueError(f'Formato inválido: {name}')
            im=ImageOps.contain(im.convert('RGB'),(288,238),Image.Resampling.LANCZOS)
            canvas=Image.new('RGB',(300,250),'#F6F1FC')
            canvas.paste(im,((300-im.width)//2,(250-im.height)//2))
            canvas.save(DST/f'{id}.jpg','JPEG',quality=95,optimize=True)
    print(f'{len(items)} imagens comerciais preparadas em private/kiwify-product-images/.')
if __name__=='__main__':main()
