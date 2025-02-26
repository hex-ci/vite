import { getColor, isBuild } from '../../testUtils'

function testPage(isNested: boolean) {
  test('pre transform', async () => {
    expect(await page.$('head meta[name=viewport]')).toBeTruthy()
  })

  test('string transform', async () => {
    expect(await page.textContent('h1')).toBe(
      isNested ? 'Nested' : 'Transformed'
    )
  })

  test('tags transform', async () => {
    const el = await page.$('head meta[name=description]')
    expect(await el.getAttribute('content')).toBe('a vite app')

    const kw = await page.$('head meta[name=keywords]')
    expect(await kw.getAttribute('content')).toBe('es modules')
  })

  test('combined transform', async () => {
    expect(await page.title()).toBe('Test HTML transforms')
    // the p should be injected to body
    expect(await page.textContent('body p.inject')).toBe('This is injected')
  })

  test('server only transform', async () => {
    if (!isBuild) {
      expect(await page.textContent('body p.server')).toMatch(
        'injected only during dev'
      )
    } else {
      expect(await page.innerHTML('body')).not.toMatch('p class="server"')
    }
  })

  test('build only transform', async () => {
    if (isBuild) {
      expect(await page.textContent('body p.build')).toMatch(
        'injected only during build'
      )
    } else {
      expect(await page.innerHTML('body')).not.toMatch('p class="build"')
    }
  })

  test('conditional transform', async () => {
    if (isNested) {
      expect(await page.textContent('body p.conditional')).toMatch(
        'injected only for /nested/'
      )
    } else {
      expect(await page.innerHTML('body')).not.toMatch('p class="conditional"')
    }
  })

  test('body prepend/append transform', async () => {
    expect(await page.innerHTML('body')).toMatch(
      /prepended to body(.*)appended to body/s
    )
  })

  test('css', async () => {
    expect(await getColor('h1')).toBe(isNested ? 'red' : 'blue')
    expect(await getColor('p')).toBe('grey')
  })
}

describe('main', () => {
  testPage(false)

  test('preserve comments', async () => {
    const html = await page.innerHTML('body')
    expect(html).toMatch(`<!-- comment one -->`)
    expect(html).toMatch(`<!-- comment two -->`)
  })
})

describe('nested', () => {
  beforeAll(async () => {
    // viteTestUrl is globally injected in scripts/jestPerTestSetup.ts
    await page.goto(viteTestUrl + '/nested/')
  })

  testPage(true)
})

describe('nested w/ query', () => {
  beforeAll(async () => {
    // viteTestUrl is globally injected in scripts/jestPerTestSetup.ts
    await page.goto(viteTestUrl + '/nested/index.html?v=1')
  })

  testPage(true)
})

if (isBuild) {
  describe('inline entry', () => {
    const _countTags = (selector) => page.$$eval(selector, (t) => t.length)
    const countScriptTags = _countTags.bind(this, 'script[type=module]')
    const countPreloadTags = _countTags.bind(this, 'link[rel=modulepreload]')

    test('is inlined', async () => {
      await page.goto(viteTestUrl + '/inline/shared-1.html?v=1')
      expect(await countScriptTags()).toBeGreaterThan(1)
      expect(await countPreloadTags()).toBe(0)
    })

    test('is not inlined', async () => {
      await page.goto(viteTestUrl + '/inline/unique.html?v=1')
      expect(await countScriptTags()).toBe(1)
      expect(await countPreloadTags()).toBeGreaterThan(0)
    })

    test('execution order when inlined', async () => {
      await page.goto(viteTestUrl + '/inline/shared-2.html?v=1')
      expect((await page.textContent('#output')).trim()).toBe(
        'dep1 common dep2 dep3 shared'
      )
    })

    test('execution order when not inlined', async () => {
      await page.goto(viteTestUrl + '/inline/unique.html?v=1')
      expect((await page.textContent('#output')).trim()).toBe(
        'dep1 common dep2 unique'
      )
    })
  })
}
