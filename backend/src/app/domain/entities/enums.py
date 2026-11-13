from enum import StrEnum


class Forma(StrEnum):
    GALAO = "galao"
    GARRAFA = "garrafa"
    SPRAY = "spray"
    DETERG = "deterg"
    ESPONJA = "esponja"
    CAIXA = "caixa"
    ROLO = "rolo"
    SACO = "saco"
    PANO = "pano"
    RODO = "rodo"
    BALDE = "balde"


class Icone(StrEnum):
    HOME = "home"
    POT = "pot"
    SHIRT = "shirt"
    DROP = "drop"
    ROLL = "roll"
    BUCKET = "bucket"
    BUILDING = "building"
    CUP = "cup"
    STORE = "store"
    FLASK = "flask"
    SPARKLE = "sparkle"
    BOXES = "boxes"


class PublicoGuia(StrEnum):
    CASA = "casa"
    EMPRESA = "empresa"
    AMBOS = "ambos"


class PublicoPromocao(StrEnum):
    TODOS = "todos"
    CASA = "casa"
    EMPRESA = "empresa"


class TipoAcao(StrEnum):
    LINK = "link"
    CUPOM = "cupom"
    AVISO = "aviso"
    PRODUTO = "produto"
    WHATSAPP = "whatsapp"


class Frequencia(StrEnum):
    UMA_VEZ = "uma_vez"
    DIARIA = "diaria"
    SEMPRE = "sempre"


class CategoriaArtigo(StrEnum):
    GERAL = "geral"
    DICAS = "dicas"
    EMPRESAS = "empresas"
    TESTAMOS = "testamos"
    NOVIDADES = "novidades"

